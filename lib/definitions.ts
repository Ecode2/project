import * as z from "zod";

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


export const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    author: z.string().min(1, "Author is required"),
    description: z.string().optional(),
    book: z
        .any()
        .refine((file) => file?.length === 1, "Book file is required")
        .refine((file) => file?.[0]?.type === "application/pdf", "File must be a PDF"),
    publication_year: z.string().optional(),
    isPublic: z.boolean().optional(),
});

export type FormSchemaData = z.infer<typeof formSchema>;

