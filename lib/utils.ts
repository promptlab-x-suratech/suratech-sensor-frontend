import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string, includeTime = false): string {
  if (!dateString) return "N/A"

  try {
    const date = new Date(dateString)

    if (isNaN(date.getTime())) {
      return "Invalid date"
    }

    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }

    if (includeTime) {
      return `${date.toLocaleDateString("en-US", options)}, ${date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`
    }

    return date.toLocaleDateString("en-US", options)
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Error"
  }
}

export function formatRawTime(dateString: string): string {
  if (!dateString) return "N/A"
  try {
    // Parse the ISO string and extract components without timezone conversion
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return "Invalid date"
    }
    
    // Format as DD/MM HH:MM (24-hour format) using UTC to avoid timezone conversion
    const day = date.getUTCDate().toString().padStart(2, '0')
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    
    return `${day}/${month} ${hours}:${minutes}`
  } catch (error) {
    console.error("Error formatting raw time:", error)
    return "Error"
  }
}

// Generate a random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
