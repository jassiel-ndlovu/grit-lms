export function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function formatTimeAgo(date: Date | string | number): string {
  const now = new Date();
  const target = new Date(date);
  const seconds = Math.floor((now.getTime() - target.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

export function formatDuration(minutes: number) {
  if (!minutes || minutes <= 0) return "No duration specified";
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

export const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    // Example: "4d 12h"
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    // Example: "12h 5m 33s"
    return `${hours}h ${minutes}m ${secs}s`;
  }

  // Example: "05:07"
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};


export const formatForDateTimeLocal = (date: Date): string => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16); // "YYYY-MM-DDTHH:mm"
};

export const parseDateTimeLocal = (dateString: string): Date => {
  const localDate = new Date(dateString);
  return new Date(localDate.getTime());
};

export const extractImageUrlsFromMarkdown = (markdown: string): string[] => {
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const urls: string[] = [];
  let match;
  
  while ((match = imageRegex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  
  return urls;
};

export function cleanUrl(slug: string): string {
  let decoded = decodeURIComponent(slug);

  const lastHyphenIndex = decoded.lastIndexOf("-");
  if (lastHyphenIndex !== -1) {
    decoded = decoded.substring(0, lastHyphenIndex);
  }

  return decoded.replace(/-/g, " ").trim();
}
