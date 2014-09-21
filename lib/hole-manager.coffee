{EventEmitter} = require 'events'
{Point, Range} = require 'atom'
Hole = require './hole'

# manages all "holes" in a editor
class HoleManager extends EventEmitter

  holes: []

  constructor: (@agda) ->

    @destroyHoles()
    @agda.once 'quit', @destroyHoles


  # convert all '?' to '{!!}'
  convertBoundaries: ->

    converted = @agda.editor.getText()
      .split(' ? ')
      .join(' {!!} ')
      .split(' ?\n')
      .join(' {!!}\n')
    @agda.editor.setText converted
    @agda.emit 'hole-manager:buffer-modified'

  indicesOf: (string, pattern) ->
    indices = []
    cursor = 0
    result = string.match pattern
    while result
      indices.push result.index + cursor
      cursor += result.index + result[0].length
      string = string.substr (result.index + result[0].length)
      result = string.match pattern
    return indices

  findHole: (index) ->
    holes = @holes.filter (hole) => hole.index is index
    return holes[0]

  destroyHole: (index) ->
    # destroy Hole
    @holes
      .filter (hole) => hole.index is index
      .forEach (hole) => hole.destroy()
    # remove from @holes
    @holes = @holes.filter (hole) => hole.index isnt index


  destroyHoles: =>
    # first, destroy all Holes
    @holes.forEach (hole) =>
      hole.destroy()
    @holes = []
    # second, destroy all wandering markers
    markers = @agda.editor.findMarkers type: 'hole'
    markers.map (marker) => marker.destroy()


  refreshGoals: (goalIndices) ->

    # get positions of all holes
    text = @agda.editor.getText()
    headIndices = @indicesOf text, /\{!/
    tailIndices = @indicesOf text, /!\}/

    # instantiate a Hole if not existed
    for headIndex, i in headIndices
      tailIndex = tailIndices[i]
      goalIndex = goalIndices[i]

      hole = @findHole goalIndex

      if hole is undefined
        # instantiate Hole
        hole = new Hole(@agda, goalIndex, headIndex, tailIndex)
        @holes.push hole

        # console.log hole.get
        # make hole {! <----> !} larger
        # pos = hole.fromIndex(headIndex + 2)
        # @agda.editor.buffer.insert(pos, ' '.repeat(2 + goalIndex.toString().length))
    @agda.emit 'hole-manager:initialized'

  #
  # agda-mode: load
  #
  loadCommand: ->
    @destroyHoles()
    @convertBoundaries()


  #
  # agda-mode: next-goal
  #
  nextGoalCommand: ->
    cursor = @agda.editor.getCursorBufferPosition()
    nextGoal = null

    positions = @holes.map (hole) =>
      start = hole.getStart()
      hole.translate start, 3

    positions.forEach (position) =>
      if position.isGreaterThan cursor
        nextGoal ?= position

    # no hole ahead of cursor, loop back
    if nextGoal is null
      nextGoal = positions[0]

    # jump only when there are goals
    if positions.length isnt 0
      @agda.editor.setCursorBufferPosition nextGoal

  #
  # agda-mode: previous-goal
  #
  previousGoalCommand: ->
    cursor = @agda.editor.getCursorBufferPosition()
    previousGoal = null

    positions = @holes.map (hole) =>
      start = hole.getStart()
      hole.translate start, 3

    positions.forEach (position) =>
      if position.isLessThan cursor
        previousGoal = position

    # no hole ahead of cursor, loop back
    if previousGoal is null
      previousGoal = positions[positions.length - 1]

    # jump only when there are goals
    if positions.length isnt 0
      @agda.editor.setCursorBufferPosition previousGoal


  #
  # agda-mode: give
  #
  giveCommand: ->
    cursor = @agda.editor.getCursorBufferPosition()
    goals = @holes.filter (hole) =>
      hole.getRange().containsPoint cursor

    # in certain hole
    if goals.length is 1
      goal = goals[0]
      goalIndex = goal.index
      start = goal.getStart()
      startIndex = goal.toIndex start
      end = goal.getEnd()
      endIndex = goal.toIndex end
      text = goal.getText()
      content = text.substring(2, text.length - 2)  # remove "{!!}"

      #
      # empty = content.replace(/\s/g, '').length is 0
      # if empty then @agda.panelView.queryExpression()
      command = "IOTCM \"#{@agda.filepath}\" NonInteractive Indirect \
        (Cmd_give #{goalIndex} (Range [Interval (Pn (Just (mkAbsolute \
        \"#{@agda.filepath}\")) #{startIndex} #{start.row + 1} #{start.column + 1})\
         (Pn (Just (mkAbsolute \"#{@agda.filepath}\")) #{endIndex} #{end.row + 1} \
          #{end.column + 1})]) \"#{content}\" )\n"
      @agda.executable.agda.stdin.write command

    else
      @agda.panelView.setStatus 'Info'
      @agda.panelView.setContent ['For this command, please place the cursor in a goal']

  giveHandler: (index) ->
    hole = @findHole index
    hole.removeBoundary()
    @destroyHole index
    @agda.emit 'hole-manager:buffer-modified'

module.exports = HoleManager
