export class Model {
  constructor(orm, storeName) {
    this.orm = orm
    this.storeName = storeName
  }

  async create(data) {
    return await this.orm.create(this.storeName, data)
  }

  async read(key) {
    return await this.orm.read(this.storeName, key)
  }

  async update(data) {
    return await this.orm.update(this.storeName, data)
  }

  async delete(key) {
    return await this.orm.delete(this.storeName, key)
  }

  async getAll() {
    return await this.orm.getAll(this.storeName)
  }
}
