export class Client {
  bucketExists = jest.fn().mockResolvedValue(true);
  makeBucket = jest.fn().mockResolvedValue(undefined);
  putObject = jest.fn().mockResolvedValue(undefined);
  removeObject = jest.fn().mockResolvedValue(undefined);

  constructor(...args: any[]) {
    void args;
  }
}
