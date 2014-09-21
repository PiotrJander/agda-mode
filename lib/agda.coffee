{Point, Range} = require 'atom'
AgdaSyntax = require './agda/syntax'
PanelView = require './view/panel'
AgdaExecutable = require './agda/executable'
HoleManager = require './hole-manager'
Stream = require './stream'
{EventEmitter} = require 'events'

# events:
#   activate
#   deactivate
#   quit

class Agda extends EventEmitter

  executablePath: null
  active: false             # show panel view if active (tab focused)
  loaded: false             # code loaded by agda
  passed: false             # code loaded and passed by agda

  constructor: (@editorView) ->
    @editor = @editorView.getModel()
    @syntax = new AgdaSyntax @editor
    @filepath = @editor.getPath()
    @executable = new AgdaExecutable
    @holeManager = new HoleManager @
    @panelView = new PanelView

    @on 'activate', =>
      @active = true
      if @loaded
        @panelView.attach()

    @on 'deactivate', =>
      @active = false
      if @loaded
        @panelView.detach()

    @on 'hole-manager:initialized', => @restoreCursor()

    @on 'hole-manager:buffer-modified', => @editor.save()

  # saves current position of the cursor
  saveCursor: ->
    @cursorPositionLock = true
    @cursorPosition = @editor.getCursorBufferPosition()

  # restores cursor position, must be paired with @saveCursor
  restoreCursor: ->
    if @cursorPositionLock

      # see if the cursor position is now stucked in some hole's boundary,
      # if so, move it into the hole
      holes = @holeManager.holes.filter (hole) =>
        hole.getRange().containsPoint @cursorPosition

      # in some hole
      if holes.length is 1
        hole = holes[0]
        # console.log "[cursor] #{@cursorPosition.toArray()}"
        # console.log "[hole] #{hole.getRange().start.toArray()} #{hole.getRange().end.toArray()}"
        newCursorPosition = hole.translate hole.getStart(), 3
        @editor.setCursorBufferPosition newCursorPosition
      # not in some hole
      else
        @editor.setCursorBufferPosition @cursorPosition

      @cursorPositionLock = false

  #         #
  # comands #
  #         #

  load: ->

    if not @loaded
      console.log '==== LOAD ===='
      @saveCursor()

      # triggered when a Agda executable is found
      @executable.once 'wired', =>
        @loaded = true

        @panelView.attach()

        @commandExecutor = new Stream.ExecuteCommand @

        @commandExecutor.on 'passed', =>
          @passed = true
          @syntax.activate()

        @executable.agda.stdout
          .pipe new Stream.Rectify
          # .pipe new Stream.Log
          .pipe new Stream.Preprocess
          .pipe new Stream.ParseSExpr
          .pipe new Stream.ParseCommand
          .pipe @commandExecutor

        @holeManager.loadCommand()
        @executable.loadCommand
          filepath: @filepath

      @executable.wire()
    else
      @restart()

  quit: ->
    if @loaded
      @loaded = false
      @passed = false
      @syntax.deactivate()
      @panelView.detach()
      @emit 'quit'

  restart: ->
    @quit()
    @load()

  nextGoal: ->
    @holeManager.nextGoalCommand() if @loaded

  previousGoal: ->
    @holeManager.previousGoalCommand() if @loaded

  give: ->
    @holeManager.giveCommand() if @loaded




module.exports = Agda
