export class UntagNodeCommand {
  constructor(
    public readonly userId: string,
    public readonly nodeId: string,
    public readonly tagId: string,
  ) {}
}
