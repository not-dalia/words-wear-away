const doesResourceExist = (resource) => {
  return Object.keys(ResourceRegister).includes(resource)
}

const isResourceValidStandardEbookURL = (resource) => {
  // https://[www.]standardebooks.org/ebooks/{author}/{bookName}[/...]
  const standardEbookURLRegex = /^https?:\/\/(www\.)?standardebooks\.org\/ebooks\/.+\/.+\/*/
  return standardEbookURLRegex.test(resource)
}

const fixStandardEbookURL = (resource) => {
  // output should be https://standardebooks.org/ebooks/{author}/{bookName}/text/single-page
  // if it ends with /text/something, this should stay
  // otherwise it should be /text/single-page
  const standardEbookURLRegex = /^https?:\/\/(www\.)?standardebooks\.org\/ebooks\/.+\/.+\/*/
  if (!standardEbookURLRegex.test(resource)) return null
  // if (resource.endsWith('/text/single-page')) return resource
  // if (resource.endsWith(/\/text\/.+/)) return resource // endsWith can't take regex
  if (resource.endsWith('/')) resource = resource.slice(0, -1)
  let endsWithText = /\/text\/.+$/.test(resource)
  if (endsWithText) return resource
  if (resource.endsWith('/text')) return resource + '/single-page'
  // if (resource.endsWith('/')) return resource + 'text/single-page'
  return resource + '/text/single-page'
}

const getResource = async (resource) => {
  if (!resource) return null
  if (doesResourceExist(resource)) {
    let book = await Book.fromJSONFile(ResourceRegister[resource])
    book.resource = resource
    return book
  } else if (isResourceValidStandardEbookURL(resource)) {
    // const url = fixStandardEbookURL(resource)
    let book = await Book.fromURL(resource)
    if (resource.endsWith('/')) resource = resource.slice(0, -1)
    book.resource = resource
    return book
  } else {
    return null
  }
}
