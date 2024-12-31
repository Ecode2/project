export type LoginInfo = {
    email : string,
    password : string
}

export type RegisterInfo = {
    username : string,
    email : string,
    password : string
}

export type UserInfo = {
    id: number,
    username: string,
    email: string
  }

export type Results = {
    id: number,
    name: string,
    token: string
}

export type ListResponse = {
    count: string,
    next: string | null,
    previous: string | null,
    results: Results[]
}

export type ApiResponse = {
    status: boolean,
    message: any,
}