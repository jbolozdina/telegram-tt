export class InputMemento {
  constructor(
    public readonly html: string,
    public readonly selectionStart: number,
    public readonly selectionEnd: number,
  ) {}
}

export class InputHistory {
  private history: InputMemento[];
  private currentIndex: number;
  private readonly maxHistory: number;

  constructor(initialState: string = '', initialSelectionStart: number = 0, initialSelectionEnd: number = 0, maxHistory: number = 50) {
    this.history = [new InputMemento(initialState, initialSelectionStart, initialSelectionEnd)];
    this.currentIndex = 0;
    this.maxHistory = maxHistory;
  }

  public save(html: string, selectionStart: number, selectionEnd: number): void {
    const current = this.history[this.currentIndex];
    if (current.html === html && current.selectionStart === selectionStart && current.selectionEnd === selectionEnd) {
      return;
    }

    this.history = this.history.slice(0, this.currentIndex + 1);

    this.history.push(new InputMemento(html, selectionStart, selectionEnd));
    this.currentIndex++;

    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  public undo(): InputMemento | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  public redo(): InputMemento | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }

  public getCurrentState(): InputMemento {
    return this.history[this.currentIndex];
  }

  public reset(html: string = '', selectionStart: number = 0, selectionEnd: number = 0): void {
    this.history = [new InputMemento(html, selectionStart, selectionEnd)];
    this.currentIndex = 0;
  }
}
