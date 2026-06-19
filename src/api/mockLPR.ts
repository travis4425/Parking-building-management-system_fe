// Mock data cho LPR (License Plate Recognition) simulation — biển số và cổng vào

// Danh sách biển số xe mock để random khi "nhận diện"
export const MOCK_PLATES = [
  '51G-123.45', '51F-678.90', '59A-111.22',
  '50A-333.44', '51K-555.66', '51H-777.88',
  '29A-123.45', '30E-456.78', '43A-789.01',
  '51C-234.56', '51D-345.67', '51B-456.78',
  '92A-001.23', '77B-999.88', '63C-555.11',
]

// Danh sách cổng vào của bãi xe
export const ENTRY_GATES = [
  { value: 'gate-1', label: 'Cổng 1 — Tầng trệt (phía Nam)' },
  { value: 'gate-2', label: 'Cổng 2 — Tầng trệt (phía Bắc)' },
  { value: 'gate-3', label: 'Cổng 3 — Tầng 2 (dành cho ô tô)' },
]
