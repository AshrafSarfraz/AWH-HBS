const Form = require("../models/Form");
const ApprovalPriority = require("../models/AprovalPriority");

// GET /api/admin/forms
// return all forms for sidebar/list (including counts etc.)
async function listForms(req, res) {
  try {
    const forms = await Form.find({}).sort({ updatedAt: -1 }).lean();

    const shaped = forms.map((f) => ({
      _id: f._id,
      formKey: f.formKey,
      displayName: f.displayName,
      description: f.description || "",
      active: !!f.active,
      isLocked: !!f.isLocked,
      fieldsCount: f.fields?.length || 0,
    }));

    return res.json(shaped);
  } catch (err) {
    console.error("listForms error", err);
    return res
      .status(500)
      .json({ error: "Server error loading forms" });
  }
}

// GET /api/admin/forms/:id
// load one form for editing, plus we will load ApprovalPriority separately from frontend
async function getFormById(req, res) {
  try {
    const form = await Form.findById(req.params.id).lean();
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }
    return res.json(form);
  } catch (err) {
    console.error("getFormById error", err);
    return res
      .status(500)
      .json({ error: "Server error loading form" });
  }
}

// controller/formAdmincontroller.js

// POST /api/admin/forms
async function createForm(req, res) {
  try {
    const {
      formKey,
      displayName,
      description = "",
      includeEmployeeInfo = false,
      allowSelfSelectManager = false, // 👈 NEW
      isLocked = true,
      active = true,
      fields = [],
    } = req.body;

    if (!formKey || !displayName) {
      return res.status(400).json({ error: "formKey and displayName are required" });
    }

    const created = await Form.create({
      formKey,
      displayName,
      description,
      includeEmployeeInfo,
      allowSelfSelectManager, // 👈 NEW
      isLocked,
      active,
      fields,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("createForm error", err);
    if (err.code === 11000 && err.keyPattern?.formKey) {
      return res.status(400).json({ error: "formKey already exists. Use a unique key." });
    }
    return res.status(500).json({ error: "Could not save form" });
  }
}

// PUT /api/admin/forms/:id
async function updateForm(req, res) {
  try {
    const {
      formKey,
      displayName,
      description = "",
      includeEmployeeInfo = false,
      allowSelfSelectManager = false, // 👈 NEW
      isLocked = true,
      active = true,
      fields = [],
    } = req.body;

    if (!formKey || !displayName) {
      return res.status(400).json({ error: "formKey and displayName are required" });
    }

    const updated = await Form.findByIdAndUpdate(
      req.params.id,
      {
        formKey,
        displayName,
        description,
        includeEmployeeInfo,
        allowSelfSelectManager, // 👈 NEW
        isLocked,
        active,
        fields,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Form not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("updateForm error", err);
    return res.status(500).json({ error: "Could not update form" });
  }
}


// GET /api/approvalPriority/:formKey
// load approval chain for a given formKey
async function getApprovalPriority(req, res) {
  try {
    const { formKey } = req.params;
    const doc = await ApprovalPriority.findOne({
      formName: formKey,
    }).lean();

    if (!doc) {
      return res.status(404).json({
        error: "No approval chain for this form",
      });
    }

    return res.json(doc);
  } catch (err) {
    console.error("getApprovalPriority error", err);
    return res
      .status(500)
      .json({ error: "Server error loading approval chain" });
  }
}

// PUT /api/approvalPriority/:formKey
// upsert sequence for that formKey
async function upsertApprovalPriority(req, res) {
  try {
    const { formKey } = req.params;
    const { sequence } = req.body;

    if (!Array.isArray(sequence) || sequence.length === 0) {
      return res
        .status(400)
        .json({ error: "sequence is required (array)" });
    }

    // normalize + sort
    const cleaned = sequence
      .map((s, idx) => ({
        role: s.role || "",
        name: s.name || "",
        email: s.email || "",
        order:
          typeof s.order === "number" ? s.order : idx + 1,
      }))
      .sort((a, b) => a.order - b.order);

    const updated = await ApprovalPriority.findOneAndUpdate(
      { formName: formKey },
      { formName: formKey, sequence: cleaned },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return res.json(updated);
  } catch (err) {
    console.error("upsertApprovalPriority error", err);
    return res
      .status(500)
      .json({ error: "Could not save approval chain" });
  }
}



// DELETE /api/admin/forms/:id?hard=true
async function deleteForm(req, res) {
  try {
    const { id } = req.params;
    const hard = String(req.query.hard || "false") === "true";

    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    if (!hard) {
      // Soft delete: just deactivate
      form.active = false;
      form.isLocked = true;
      await form.save();
      return res.json({ success: true, archived: true });
    }

    // Hard delete: remove form + its approval chain
    const formKey = form.formKey;
    await Form.deleteOne({ _id: id });
    await ApprovalPriority.deleteOne({ formName: formKey });

    return res.json({ success: true, deleted: true });
  } catch (err) {
    console.error("deleteForm error", err);
    return res.status(500).json({ error: "Could not delete form" });
  }
}


module.exports = {
  listForms,
  getFormById,
  createForm,
  updateForm,
  getApprovalPriority,
  upsertApprovalPriority,
  deleteForm,
};
