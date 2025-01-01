import { AxiosError } from "axios";
import { AllBookPage, BookCoverResponse, BookListResponse, LoginInfo, OneBookPage, RegisterInfo, UserInfo } from "@/lib/definitions"
import api from "@/lib/axiosInstance"

export async function checkToken() {
	const token = localStorage.getItem("access_token");

	if (typeof token !== 'string') {
		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
		localStorage.removeItem('user');
		return { status: false, message: "Access Token Not found or recognised" };
	}

	try {
		const response = await api.post(`/auth/token/verify/`, {
			token: token.slice(7)
		});

		if (response.status === 200) {
			return { status: true, message: "Access Token Verified" };
		}
	} catch (error) {
		const axiosError = error as AxiosError;

		if (axiosError.response && axiosError.response.status === 401) {
			const refresh_token = localStorage.getItem("refresh_token");

			if (typeof refresh_token !== 'string') {
				return { status: false, message: "Unauthorized access, Relogin" };
			}

			try {
				const refresh_response = await api.post(`/auth/token/refresh/`, {
					refresh: refresh_token
				});

				if (refresh_response.status === 200) {
					const data = refresh_response.data;
					localStorage.setItem("access_token", `Bearer ${data.access}`);
					return { status: true, message: "Access Token Verified" };
				} else {
					localStorage.removeItem("access_token");
					localStorage.removeItem("refresh_token");
					localStorage.removeItem('user');
					return { status: false, message: "Access Token not Valid" };
				}
			} catch (refreshError) {
				const refreshAxiosError = refreshError as AxiosError;

				if (refreshAxiosError.response && refreshAxiosError.response.status === 401) {
					localStorage.removeItem("access_token");
					localStorage.removeItem("refresh_token");
					localStorage.removeItem('user');
					return { status: false, message: "Unauthorized access, Relogin" };
				} else {
					localStorage.removeItem("access_token");
					localStorage.removeItem("refresh_token");
					localStorage.removeItem('user');
					return { status: false, message: "Access Token not Valid" };
				}
			}
		} else {
			localStorage.removeItem("access_token");
			return { status: false, message: "Access Token not Valid" };
		}
	}

	return { status: false, message: "Access Token not Valid" };
}

export const userInfo = async () => {

	const user = localStorage.getItem('user');

	if (user && JSON.parse(user)) {
		const userInfo: UserInfo = JSON.parse(user)

		return {
			status: true,
			message: userInfo
		}
	}


	const token = localStorage.getItem("access_token");
	if (typeof token !== 'string') { return { status: false, message: "Access Token Not found or recognised" } }

	try {
		const response = await api.get(`/auth/profile/`, {
			headers: {
				"Authorization": token
			}
		})

		if (response.status != 200) { return { status: false, message: "Unauthorised access, Relogin" } }


		const data: UserInfo = response.data
		localStorage.setItem('user', JSON.stringify(data));

		return {
			status: true,
			message: data,
		}

	} catch (error) {

		console.log("an error", error)
		return { status: false, message: "Something went wrong" }
	}
}

export const login = async (userInfo: LoginInfo) => {
	if (!userInfo) { return { status: false, message: "Credentials Required" } }
	if (!userInfo.email) { return { status: false, message: "Email Required" } }
	if (!userInfo.password) { return { status: false, message: "Password Required" } }

	try {
		const response = await api.post(`/auth/login/`, {
			username: userInfo.email,
			password: userInfo.password,
		},
		)
		console.log(response)
		console.log("logging in user")

		if (response.status == 401) { return { status: false, message: "Unauthorised access, Relogin" } }

		if (response.status != 200) {
			const data = response.data
			return {
				status: false,
				message: data,
			}
		}

		const data = response.data
		localStorage.setItem("access_token", `Bearer ${data.access}`);
		localStorage.setItem("refresh_token", `${data.refresh}`);

		return {
			status: true,
			message: "SignIn successful",
		}

	} catch (error) {

		console.log("an error", error)
		return { status: false, message: "Something went wrong" }
	}
}


export const register = async (userInfo: RegisterInfo) => {
	if (!userInfo) { return { status: false, message: "Credentials Required" } }
	if (!userInfo.username) { return { status: false, message: "Username Required" } }
	if (!userInfo.email) { return { status: false, message: "Username Required" } }
	if (!userInfo.password) { return { status: false, message: "Password Required" } }

	try {
		const response = await api.post(`/auth/register/`, {
			email: userInfo.email,
			password: userInfo.password,
		},
		)
		console.log(response)
		console.log("logging in user")

		if (response.status != 201) { return { status: false, message: "Something went wrong" } }

		const data = response.data
		localStorage.setItem("access_token", `Bearer ${data.access}`);
		localStorage.setItem("refresh_token", `${data.refresh}`);

		return {
			status: true,
			message: "User Created Successful",
		}

	} catch (error) {

		console.log("an error", error)
		return { status: false, message: "Something went wrong" }
	}
}

export const ListPublicbooks = async () => {
	const token = localStorage.getItem("access_token");

	try {
		const response = token ?
			await api.get(`/books/`,
				{
					headers: {
						"Authorization": token
					}
				}) :
			await api.get(`/books/`)

		if (response.status != 200) { return { status: false, message: "Something went wrong" } }

		const data: BookListResponse = response.data

		return {
			status: true,
			message: data,
		}

	} catch (error) {

		console.log("an error", error)
		return { status: false, message: "Something went wrong" }
	}
}

export const GetBookInfo = async (id: number) => {
	const token = localStorage.getItem("access_token");

	try {
		const response = token ?
			await api.get(`/books/`, {
				headers: {
					"Authorization": token
				}
			}) :
	 		await api.get(`/books/`)

		if (response.status != 200) { return { status: false, message: "Something went wrong" } }

		const data: BookCoverResponse = response.data

		return {
			status: true,
			message: data,
		}

	} catch (error) {
		console.log("an error", error)
		return { status: false, message: "Something went wrong" }
	}
}

export const GetOnePage = async (id: number, page: number) => {
	const token = localStorage.getItem("access_token");

	try {
		const response = token ?
			await api.get(`/books/${id}/read-page/?page=${page}`, {
				headers: {
					"Authorization": token
				}
			}) :
			await api.get(`/books/${id}/read-page/?page=${page}`)

		if (response.status != 200) { return { status: false, message: "Something went wrong" } }

		const data: OneBookPage = response.data

		return {
			status: true,
			message: data,
		}

	} catch (error) {
		console.log("an error", error)
		return { status: false, message: "Something went wrong" }
	}
}

export const GetAllPage = async (id: number, page: number) => {
	const token = localStorage.getItem("access_token");

	try {
		const response = token ?

			await api.get(`/books/${id}/pages/`, {
				headers: {
					"Authorization": token
				}
			}) :
			await api.get(`/books/${id}/pages/`)

		if (response.status != 200) { return { status: false, message: "Something went wrong" } }

		const data: AllBookPage = response.data

		return {
			status: true,
			message: data,
		}

	} catch (error) {
		console.log("an error", error)
		return { status: false, message: "Something went wrong" }
	}
}