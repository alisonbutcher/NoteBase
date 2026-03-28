export class EditNodeCommand {
  constructor(
    public readonly userId: string,
    public readonly nodeId: string,
    public readonly content: string,
  ) {}
}
