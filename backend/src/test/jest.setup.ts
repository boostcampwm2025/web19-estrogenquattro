// Jest setup file to mock ESM modules
jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      users: {
        getByUsername: jest.fn(),
        follow: jest.fn(),
        unfollow: jest.fn(),
      },
    },
    request: jest.fn(),
  })),
}));
