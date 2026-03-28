export class CreateNodeCommand {
  constructor(
    public readonly userId: string,
    public readonly nodeId: string,
    public readonly content: string,
    public readonly parentId: string | null,
    public readonly dailyNoteDate: string,
    public readonly position: number,
  ) {}
}
