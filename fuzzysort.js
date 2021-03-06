/*
WHAT: SublimeText-like Fuzzy Search

USAGE:
  require('fuzzysort').single('fs', 'Fuzzy Search')
  // {score: 0.1, highlighted: '<b>F</b>uzzy <b>S</b>earch'}

  require('fuzzysort').single('test', 'test')
  // {score: 0, highlighted}

  require('fuzzysort').single('doesnt exist', 'target')
  // {}
*/

;(function() {
  var fuzzysort = {

    noMatchLimit: 100, // if there's no match for a span this long, give up
    highlightMatches: true,
    highlightOpen: '<b>',
    highlightClose: '</b>',
    limit: null, // don't return more results than this

    single: (search, target) => {
      const lowerSearch = search.toLowerCase()
      const searchLength = lowerSearch.length
      const searchCode = lowerSearch.charCodeAt(0)
      const isObj = typeof target === 'object'
      const infoFunc = isObj ? fuzzysort.infoObj : fuzzysort.info
      const result = infoFunc(lowerSearch, searchLength, searchCode, target)
      if(result === null) return null
      if(fuzzysort.highlightMatches) result.highlighted = fuzzysort.highlight(result)
      return result
    },

    go: (search, targets) => {
      if(search === '') {const a=[];a.total=0;return a}
      const isObj = typeof targets[0] === 'object'
      const infoFunc = isObj ? fuzzysort.infoObj : fuzzysort.info
      const lowerSearch = search.toLowerCase()
      const searchLength = lowerSearch.length
      const searchCode = lowerSearch.charCodeAt(0)
      const results = []
      var resultsLen = 0
      var i = targets.length-1
      for(; i>=0; i-=1) {
        const result = infoFunc(lowerSearch, searchLength, searchCode, targets[i])
        if(result) results[resultsLen++] = result
      }

      results.sort(compareResults)
      // quickSortResults(results, 0, resultsLen)

      results.total = resultsLen
      if(fuzzysort.limit!==null && resultsLen > fuzzysort.limit) {
        results.length = fuzzysort.limit
      }
      if(fuzzysort.highlightMatches) {
        for (i = results.length - 1; i >= 0; i--) {
          const result = results[i]
          result.highlighted = fuzzysort.highlight(result)
        }
      }

      return results
    },

    goAsync: (search, targets) => {
      var canceled = false
      const p = new Promise((resolve, reject) => {
        if(search === '') {const a=[];a.total=0;return resolve(a)}
        const isObj = typeof targets[0] === 'object'
        const infoFunc = isObj ? fuzzysort.infoObj : fuzzysort.info
        const itemsPerCheck = 1000
        const lowerSearch = search.toLowerCase()
        const searchLength = lowerSearch.length
        const searchCode = lowerSearch.charCodeAt(0)
        const results = []
        var resultsLen = 0
        var i = targets.length-1
        function step() {
          if(canceled) return reject('canceled')

          const startMs = Date.now()

          for(; i>=0; i-=1) {
            const result = infoFunc(lowerSearch, searchLength, searchCode, targets[i])
            if(result) results[resultsLen++] = result

            if(i%itemsPerCheck===0) {
              if(Date.now() - startMs >= 12) {
                ;(typeof setImmediate !== 'undefined')?setImmediate(step):setTimeout(step)
                return
              }
            }
          }

          results.sort(compareResults)
          // quickSortResults(results, 0, resultsLen)

          results.total = resultsLen
          if(fuzzysort.limit!==null && resultsLen > fuzzysort.limit) {
            results.length = fuzzysort.limit
          }
          if(fuzzysort.highlightMatches) {
            for (i = results.length - 1; i >= 0; i--) {
              const result = results[i]
              result.highlighted = fuzzysort.highlight(result)
            }
          }

          resolve(results)
        }

        if(typeof setImmediate !== 'undefined') {
          setImmediate(step)
        } else {
          step()
        }
        // step() // This speeds up the browser a lot. setTimeout is slow
        // // ;(typeof setImmediate !== 'undefined')?setImmediate(step):setTimeout(step)
      })
      p.cancel = () => {
        canceled = true
      }
      return p
    },

    infoObj: (lowerSearch, searchLength, searchCode, obj) => {
      var searchI = 0 // where we at
      var targetI = 0 // where you at

      var noMatchCount = 0 // how long since we've seen a match
      var matches // target indexes
      var matchesLen = 1

      const lowerTarget = obj.lower
      const targetLength = lowerTarget.length
      var targetCode = lowerTarget.charCodeAt(0)

      // very basic fuzzy match; to remove targets with no match ASAP
      // walk through search and target. find sequential matches.
      // if all chars aren't found then exit
      while(true) {
        const isMatch = searchCode === targetCode

        if(isMatch) {
          if(matches === undefined) {
            matches = [targetI]
          } else {
            matches[matchesLen++] = targetI
          }

          searchI += 1
          if(searchI === searchLength) break
          searchCode = lowerSearch.charCodeAt(searchI)
          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1
        if(targetI === targetLength) return null
        targetCode = lowerTarget.charCodeAt(targetI)
      }

      obj.matches = matches
      return fuzzysort.infoStrict(lowerSearch, searchLength, searchCode, obj)
    },

    info: (lowerSearch, searchLength, searchCode, target) => {
      var searchI = 0 // where we at
      var targetI = 0 // where you at

      var noMatchCount = 0 // how long since we've seen a match
      var matches // target indexes
      var matchesLen = 1

      const lowerTarget = target.toLowerCase()
      const targetLength = lowerTarget.length
      var targetCode = lowerTarget.charCodeAt(0)

      // very basic fuzzy match; to remove targets with no match ASAP
      // walk through search and target. find sequential matches.
      // if all chars aren't found then exit
      while(true) {
        const isMatch = searchCode === targetCode

        if(isMatch) {
          if(matches === undefined) {
            matches = [targetI]
          } else {
            matches[matchesLen++] = targetI
          }

          searchI += 1
          if(searchI === searchLength) break
          searchCode = lowerSearch.charCodeAt(searchI)
          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) return null
        }

        targetI += 1
        if(targetI === targetLength) return null
        targetCode = lowerTarget.charCodeAt(targetI)
      }

      { // This obj creation needs to be scoped
        const obj = {matches, target, lower:lowerTarget}
        return fuzzysort.infoStrict(lowerSearch, searchLength, searchCode, obj)
      }
    },

    infoStrict: (lowerSearch, searchLength, searchCode, obj) => {
      // Let's try a more advanced and strict test to improve the score
      // only count it as a match if it's consecutive or a beginning character!
      // we use information about previous matches to skip around here and improve performance

      const matches = obj.matches
      const lowerTarget = obj.lower
      const targetLength = lowerTarget.length
      const target = obj.target

      var strictSuccess = false
      var strictMatches
      var strictMatchesLen = 1

      var wasUpper = null
      var wasWord = false
      var isConsec = false

      var searchI = 0
      var noMatchCount = 0

      if(matches[0]>0) {
        // skip and backfill history
        targetI = matches[0]
        const targetCode = target.charCodeAt(targetI-1)
        wasUpper = targetCode>=65&&targetCode<=90
        wasWord = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
      } else {
        targetI = 0
      }


      while(true) {

        if (targetI >= targetLength) {
          // We failed to find a good spot for the search char, go back to the previous search char and force it forward
          if (searchI <= 0) break
          searchI -= 1

          const lastMatch = strictMatches[--strictMatchesLen]
          targetI = lastMatch + 1

          isConsec = false
          // backfill history
          const targetCode = target.charCodeAt(targetI-1)
          wasUpper = targetCode>=65&&targetCode<=90
          wasWord = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
          continue
        }

        const lowerTargetCode = lowerTarget.charCodeAt(targetI)
        if(!isConsec) {
          const targetCode = target.charCodeAt(targetI)
          const isUpper = targetCode>=65&&targetCode<=90
          const isWord = lowerTargetCode>=97&&lowerTargetCode<=122 || lowerTargetCode>=48&&lowerTargetCode<=57
          const isBeginning = isUpper && !wasUpper || !wasWord || !isWord
          wasUpper = isUpper
          wasWord = isWord
          if (!isBeginning) {
            targetI += 1
            continue
          }
        }

        const isMatch = lowerSearch.charCodeAt(searchI) === lowerTargetCode

        if(isMatch) {
          if(strictMatches === undefined) {
            strictMatches = [targetI]
          } else {
            strictMatches[strictMatchesLen++] = targetI
          }

          searchI += 1
          if(searchI === searchLength) {
            strictSuccess = true
            break
          }

          targetI += 1
          isConsec = true
          const wouldSkipAhead = matches[searchI] > targetI
          if(wouldSkipAhead) {
            const nextMatchIsNextTarget = matches[searchI] === targetI
            if(!nextMatchIsNextTarget) {
              // skip and backfill history
              targetI = matches[searchI]
              isConsec = false
              const targetCode = target.charCodeAt(targetI-1)
              wasUpper = targetCode>=65&&targetCode<=90
              wasWord = wasUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
            }
          }

          noMatchCount = 0
        } else {
          noMatchCount += 1
          if(noMatchCount >= fuzzysort.noMatchLimit) break
          isConsec = false
          targetI += 1
        }

      }

      { // tally up the score & keep track of matches for highlighting later
        obj.score = 0
        var lastTargetI = -1
        const theMatches = strictSuccess ? strictMatches : matches
        for(const targetI of theMatches) {
          // score only goes up if they not consecutive
          if(lastTargetI !== targetI - 1) obj.score += targetI

          lastTargetI = targetI
        }
        if(!strictSuccess) obj.score *= 1000
        obj.score += targetLength - searchLength

        if(fuzzysort.highlightMatches) {
          obj.theMatches = strictSuccess ? strictMatches : matches
        }

        return obj
      }
    },

    highlight: (result) => {
      var highlighted = ''
      var matchesIndex = 0
      var opened = false
      const target = result.target
      const targetLength = target.length
      const theMatches = result.theMatches
      for(var i=0; i<targetLength; i++) {
        if(theMatches[matchesIndex] === i) {
          matchesIndex += 1
          if(!opened) {
            highlighted += fuzzysort.highlightOpen
            opened = true
          }

          if(matchesIndex === theMatches.length) {
            highlighted += `${target[i]}${fuzzysort.highlightClose}${target.substr(i+1)}`
            break
          }
        } else {
          if(opened) {
            highlighted += fuzzysort.highlightClose
            opened = false
          }
        }
        highlighted += target[i]
      }

      return highlighted
    }
  }





  function quickSortPartition(results, left, right) {
    const cmp = results[right-1].score
    var minEnd = left
    var maxEnd = left
    for (; maxEnd < right-1; maxEnd += 1) {
      if (results[maxEnd].score <= cmp) {
        swap(results, maxEnd, minEnd)
        minEnd += 1
      }
    }
    swap(results, minEnd, right-1)
    return minEnd
  }

  function swap(results, i, j) {
    const temp = results[i]
    results[i] = results[j]
    results[j] = temp
  }

  function quickSortResults(results, left, right) {
    if (left < right) {
      var p = quickSortPartition(results, left, right)
      quickSortResults(results, left, p)
      quickSortResults(results, p + 1, right)
    }
  }

  function compareResults(a,b) {
    return a.score - b.score
  }




  // Export fuzzysort
    if(typeof module !== 'undefined' && module.exports) {
      module.exports = fuzzysort
    } else if(typeof window !== 'undefined') {
      window.fuzzysort = fuzzysort
    }
})()

