{$} = require 'atom'
{Transform} = require 'stream'

class ExecuteCommand extends Transform

  constructor: (@agda) ->
    super
      objectMode: true

  _transform: (command, encoding, next) ->

    switch command.type

      when 'info-action: type-checking'
        @agda.panelView.setStatus 'Type Checking'
        @agda.panelView.appendContent command.content

      when 'info-action: error'
        @agda.panelView.setStatus 'Error', 'error'
        @agda.panelView.setContent command.content

      when 'info-action: all goals'

        # no more goals, all good
        if command.content.length is 0
          @agda.panelView.setStatus 'No Goals', 'success'
        else
          @agda.panelView.setStatus 'Goals', 'info'

          # refresh holes with given goals
          indices = command.content.map (goal) => parseInt /^\?(\d+)\s\:\s/.exec(goal)[1]
          @agda.holeManager.resetGoals indices

        @agda.panelView.setContent command.content



        # we consider it passed, when this info-action shows up
        @emit 'passed'

      when 'give-action'
        @agda.holeManager.giveHandler command.holeIndex

    next()

module.exports = ExecuteCommand
