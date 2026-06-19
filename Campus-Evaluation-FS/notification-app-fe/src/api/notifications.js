export async function fetchNotifications() {
  const url = import.meta.env.REACT_API_KEY;
  const token = import.meta.env.AUTH_TOKEN;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch notifications: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}
