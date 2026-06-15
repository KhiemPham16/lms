import axiosClient from './axiosClient';

export async function login(payload) {
    const response = await axiosClient.post('/auth/login', payload);
    return response.data;
}

export async function getMe() {
    const response = await axiosClient.get('/users/me');
    return response.data;
}

export async function logout() {
    const response = await axiosClient.post('/auth/logout');
    return response.data;
}

export async function forgotPassword(payload) {
    const response = await axiosClient.post('/auth/forgot-password', payload);
    return response.data;
}

export async function resetPassword(payload) {
    const response = await axiosClient.post('/auth/reset-password', payload);
    return response.data;
}
