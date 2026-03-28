export class CreateTagCommand {
  constructor(
    public readonly userId: string,
    public readonly tagId: string,
    public readonly tagName: string,
    public readonly color: string | null,
  ) {}
}
