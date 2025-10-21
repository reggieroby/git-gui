export async function gql(query, variables, operationName) {
  console.log({ query, variables, operationName })
  const res = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables, operationName })
  })
  const json = await res.json().catch(() => ({}))
  console.log({ query, variables, json })
  return json
}

export default gql

