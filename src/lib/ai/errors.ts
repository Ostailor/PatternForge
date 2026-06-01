export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export class AIResponseError extends Error {
  status?: number;
  body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = "AIResponseError";
    this.status = status;
    this.body = body;
  }
}

export class AIResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIResponseParseError";
  }
}
