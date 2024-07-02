export function cabin(element, data) {
  let template = element.innerHTML.trim()
  const eachRegex = /{{#each (\w+)}}([\s\S]*?){{\/each}}/g
  const ifRegex = /{{#if (\w+)}}([\s\S]*?){{\/if}}/g
  const varRegex = /{{(\w+)}}/g

  template = template.replace(eachRegex, (_match, key, content) => {
    const items = data[key] || []
    return items
      .map((item) => content.replace(varRegex, (_, k) => item[k]))
      .join('')
  })

  template = template.replace(ifRegex, (_match, key, content) => {
    return data[key] ? content : ''
  })

  template = template.replace(varRegex, (_match, key) => {
    return data[key] !== undefined ? data[key] : ''
  })

  return template
}
