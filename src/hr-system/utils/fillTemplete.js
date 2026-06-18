function fillTemplate(str, data = {}) {
  // replaces {{key}} with data[key]
  return str.replace(/{{\s*([^}]+)\s*}}/g, (match, key) => {
    const cleanKey = key.trim();
    return data[cleanKey] !== undefined ? data[cleanKey] : '';
  });
}

module.exports = fillTemplate;
