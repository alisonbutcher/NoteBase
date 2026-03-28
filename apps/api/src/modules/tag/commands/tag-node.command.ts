export class TagNodeCommand {
  constructor(
    public readonly userId: string,
    public readonly nodeId: string,
    public readonly tagId: string,
    public readonly tagName: string,
  ) {}
}
