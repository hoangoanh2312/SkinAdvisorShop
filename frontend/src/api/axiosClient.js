import axios from 'axios'
const axiosClient=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://localhost:5000/api',headers:{'Content-Type':'application/json'}})
axiosClient.interceptors.request.use(config=>{const token=localStorage.getItem('skinora_token');if(token)config.headers.Authorization=`Bearer ${token}`;return config})
axiosClient.interceptors.response.use(response=>response,error=>Promise.reject(error))
export default axiosClient
