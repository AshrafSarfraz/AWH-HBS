const ID = /^[a-f0-9]{24}$/i;
function pageLimit(value, fallback, max) {
  return Math.max(1, Math.min(parseInt(value, 10) || fallback, max));
}
function encodeCursor(row, field = "createdAt") {
  return row ? `${new Date(row[field]).toISOString()}|${row._id}` : null;
}
function cursorFilter(value, field = "createdAt") {
  const [date, id, extra] = String(value).split("|");
  const time = new Date(date);
  if (Number.isNaN(time.getTime()) || extra !== undefined || (id !== undefined && !ID.test(id))) {
    const error = new Error("Invalid pagination cursor");
    error.status = error.statusCode = 400;
    throw error;
  }
  return id ? {$or: [{[field]: {$lt: time}}, {[field]: time, _id: {$lt: id}}]} : {[field]: {$lt: time}};
}
module.exports = {pageLimit, encodeCursor, cursorFilter};
