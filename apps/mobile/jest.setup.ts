import * as matchers from "@testing-library/react-native/matchers";

expect.extend(matchers);

// Global fetch mock (tests should override per-test as needed)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);
