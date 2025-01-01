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


export interface BookCoverResponse {
    id: number,
    title: string,
    description: string | null,
    user: string,
    author: string | null,
    production_year: number | null,
    status: string,
    total_page: number | null,
    updated_at: string,
    created_at: string,
    book_cover: string
}

export type BookListResponse = {
    count: string,
    next: string | null,
    previous: string | null,
    results: BookCoverResponse[]
}

export type OneBookPage = {
    [pageNumber: string]: string;
}

export type AllBookPage = OneBookPage[]


export type ApiResponse = {
    status: boolean,
    message: any,
}

export interface AuthContextType {
    user: UserInfo | null,
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>, 
    register: (username: string, email: string, password: string) => Promise<void>, 
    logout: () => void
  }

