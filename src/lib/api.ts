import axios from "axios";
import { ApiErrorSchema } from "./api-schema";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json"
  }
});

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const parsed = ApiErrorSchema.safeParse(data);
    if (parsed.success && parsed.data.error?.message) {
      return parsed.data.error.message;
    }
    return error.message || "Erro ao comunicar com a API";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado";
}

export function getApiErrorCode(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const parsed = ApiErrorSchema.safeParse(data);
    if (parsed.success && parsed.data.error?.code) {
      return parsed.data.error.code;
    }
  }
  return null;
}
