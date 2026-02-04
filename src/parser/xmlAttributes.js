const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'"
};

export function decodeXmlEntities(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => ENTITY_MAP[entity] || entity);
}

export function parseXmlAttributes(attributeText) {
  const attributes = {};
  const matcher = /([A-Za-z0-9_:-]+)="([^"]*)"/g;
  let match = matcher.exec(attributeText);

  while (match) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
    match = matcher.exec(attributeText);
  }

  return attributes;
}
