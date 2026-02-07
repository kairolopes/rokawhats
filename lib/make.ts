const regionBase = 'https://us1.make.com'

export async function makePing(token: string) {
  const res = await fetch(`${regionBase}/api/v2/ping`, {
    method: 'GET',
    headers: {
      Authorization: `Token ${token}`,
      Accept: '*/*',
    },
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text }
}
