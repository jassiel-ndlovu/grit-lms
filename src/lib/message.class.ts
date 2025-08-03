type MessageType = "error" |
                    "warning" |
                    "success" |
                    "info";

interface AppMessage {
  id?: string;
  type: MessageType;
  content: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  }
}

export class Message implements AppMessage {
  public id: string;
  public type: MessageType;
  public content: string;
  public title?: string;
  public duration?: number;
  public action?: { 
    label: string; 
    handler: () => void; 
  };

  constructor(message: Omit<AppMessage, "id">) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.type = message.type;
    this.content = message.content;
    this.title = message.title;
    this.duration = message.duration;
    this.action = message.action;
  }

  public isError(): boolean {
    return this.type === "error";
  }

  public isSuccess(): boolean {
    return this.type === "success";
  }

  static error(content: string, options?: Partial<AppMessage>): Message {
    return new Message({ type: "error", content, ...options});
  }

  static success(content: string, options?: Partial<AppMessage>): Message {
    return new Message({ type: "success", content, ...options});
  }

  static warning(content: string, options?: Partial<AppMessage>): Message {
    return new Message({ type: "warning", content, ...options});
  }

  static info(content: string, options?: Partial<AppMessage>): Message {
    return new Message({ type: "info", content, ...options});
  }
}