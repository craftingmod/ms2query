export class DungeonNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

export class InternalServerError extends Error {
  public statusCode: number
  public responseHTML: string
  constructor(message: string, responseHTML: string, statusCode: number) {
    super(message)
    this.name = "InternalServerError"
    this.responseHTML = responseHTML
    this.statusCode = statusCode
  }
}

export class CharacterNotFoundError extends Error {
  public nickname: string
  constructor(message: string, nickname: string) {
    super(message)
    this.name = "CharacterNotFoundError"
    this.nickname = nickname
  }
}

export class InvalidParameterError extends Error {
  public paramName: string
  constructor(message: string, paramName: string) {
    super(message)
    this.name = "InvalidParameterError"
    this.paramName = paramName
  }
}