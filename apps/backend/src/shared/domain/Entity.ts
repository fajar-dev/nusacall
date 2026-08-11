export abstract class Entity<T> {
  protected readonly id: T;
  constructor(id: T) {
    this.id = id;
  }
}
