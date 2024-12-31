import {LoginInfo, RegisterInfo, UserInfo} from "@/lib/definitions"
import api from "@/lib/axiosInstance"

export async function checkToken() {
  
    const token = localStorage.getItem("access_token");
  
    if (typeof token !== 'string') {return { status: false, message: "Access Token Not found or recognised"} }
  
    try {
        const response = await api.post(`/auth/token/verify/`, {
            token: token.slice(7)
            })

        if (response.status == 200) {return {status: true, message: "Access Token Verified"}}

        if (response.status != 200 && response.status != 401) {
            localStorage.removeItem("access_token")
            return {status: false, message: "Access Token not Valid"}
           }

        const refresh_token = localStorage.getItem("refresh_token");
        if (typeof refresh_token !== 'string') {return {status : false, message : "Unauthorised access, Relogin"} }
        
        const refresh_response = await api.post(`/auth/token/refresh/`, {
            refresh: refresh_token
            })
        
        if (response.status != 200) {
            localStorage.removeItem("access_token")
            localStorage.getItem("refresh_token");
            return {status: false, message: "Unauthorised access, Relogin"}
            }
        
        const data = refresh_response.data
        
        localStorage.setItem("access_token", data.access)
        return {status: true, message: "Access Token Verified"}

        
    }catch (error) {
      return {status: false, message: "An error occured"}
    } 
  
}

export const userInfo = async () => {

    const token = localStorage.getItem("access_token");
    if (typeof token !== 'string') {return { status: false, message: "Access Token Not found or recognised"} }

    try {
        const response = await api.get(`/auth/profile/`,{
            headers: {
                "Authorization": token
            }
        })

        if (response.status != 200) {return {status : false, message : "Unauthorised access, Relogin"}}


        const data: UserInfo = response.data

        return {
          status: true,
          message: data,
        }

    } catch (error) {
        
      console.log("an error", error)
      return {status: false, message: "Something went wrong"}
    }
}

export const login = async (userInfo : LoginInfo) => {
    if (!userInfo) { return {status: false, message: "Credentials Required"} }
    if (!userInfo.email){ return {status: false, message: "Email Required"} }
    if (!userInfo.password){ return {status: false, message: "Password Required"} }

    try {
        const response = await api.post(`/auth/login/`, {
            username : userInfo.email,
            password : userInfo.password,
          },
        )
        console.log(response)
        console.log("logging in user")

        if (response.status == 401) {return {status : false, message : "Unauthorised access, Relogin"}}

        if (response.status != 200) {
          const data = response.data
          return {status: false,
            message: data,
          }
        }

        const data = response.data
        localStorage.setItem("access_token", `Bearer ${data.access}`);

        return {
          status: true,
          message: "SignIn successful",
        }

    } catch (error) {

      console.log("an error", error)
      return {status: false, message: "Something went wrong"}
    }
}


export const register = async (userInfo: RegisterInfo) => {
    if (!userInfo) { return {status: false, message: "Credentials Required"} }
    if (!userInfo.username){ return {status: false, message: "Username Required"} }
    if (!userInfo.email){ return {status: false, message: "Username Required"} }
    if (!userInfo.password){ return {status: false, message: "Password Required"} }

    try {
        const response = await api.post(`/auth/register/`, {
            email : userInfo.email,
            password : userInfo.password,
          },
        )
        console.log(response)
        console.log("logging in user")

        if (response.status != 201) {return {status : false, message : "Something went wrong"}}

        const data = response.data
        localStorage.setItem("access_token", `Bearer ${data.access}`);
        localStorage.setItem("access_token", `Bearer ${data.refresh}`);

        return {
          status: true,
          message: "User Created Successful",
        }

    } catch (error) {

      console.log("an error", error)
      return {status: false, message: "Something went wrong"}
    }
}

