const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

export async function openDatabaseAsync(
  _name: string
): Promise<typeof mockDb> {
  return mockDb;
}

export function SQLiteProvider({ children }: { children: unknown }) {
  return children;
}
