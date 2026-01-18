type Decorator = (...args: unknown[]) => unknown;

const createDecorator =
  (): Decorator =>
  () =>
  () => {};

export const Entity = createDecorator();
export const PrimaryGeneratedColumn = createDecorator();
export const Column = createDecorator();
export const ManyToOne = createDecorator();
export const JoinColumn = createDecorator();
