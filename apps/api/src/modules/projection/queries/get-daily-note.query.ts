export class GetDailyNoteQuery {
  constructor(
    public readonly userId: string,
    public readonly date: string,
  ) {}
}
