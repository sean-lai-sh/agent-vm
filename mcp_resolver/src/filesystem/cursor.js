// Cursor management for pagination
export function createCursor(type, filePath, offset, fileHash) {
  const cursor = { type, path: filePath, offset, hash: fileHash };
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

export function parseCursor(cursorString) {
  const decoded = Buffer.from(cursorString, 'base64').toString('utf8');
  const cursor = JSON.parse(decoded);
  if (!cursor.type || !cursor.path || typeof cursor.offset !== 'number') {
    throw new Error("Invalid cursor format");
  }
  return cursor;
}
