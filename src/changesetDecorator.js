import {Decoration, DecorationSet} from "prosemirror-view"

export class ChangesetDecorator {
    constructor() {
        this.showDeletedText = true
    }

    createDecorations(doc, changeset) {
        if (!changeset || !changeset.changes) {
            console.log('No changeset or changes to decorate')
            return DecorationSet.empty
        }

        const decos = []
        const changes = Array.isArray(changeset.changes) ? changeset.changes : []
        console.log(`Creating decorations for ${changes.length} changes`)

        changes.forEach(change => {
            const metadata = {
                user: changeset.metadata?.user || 'Anonymous',
                timestamp: changeset.metadata?.timestamp || Date.now()
            }

            if (change.type === 'insertion') {
                // Handle insertions
                decos.push(Decoration.inline(change.from, change.to, {
                    class: 'suggestion-add',
                    inclusiveStart: true,
                    inclusiveEnd: false,
                    attributes: { 
                        'data-suggestion': 'add',
                        'data-inserted': change.inserted
                    }
                }))
            } else if (change.type === 'deletion') {
                // Handle deletions
                if (this.showDeletedText) {
                    decos.push(Decoration.inline(change.from, change.to, {
                        class: 'suggestion-delete expanded',
                        inclusiveStart: true,
                        inclusiveEnd: false,
                        attributes: {
                            'data-suggestion': 'delete',
                            'data-deleted-text': change.deleted
                        }
                    }))
                    
                    // Add tooltip for expanded deletion
                    decos.push(this.createTooltip(change, metadata))
                } else {
                    decos.push(Decoration.widget(change.from, () => {
                        const marker = document.createElement('span')
                        marker.className = 'deletion-marker'
                        marker.setAttribute('data-deleted-text', change.deleted)
                        return marker
                    }, { 
                        metadata,
                        side: 1 
                    }))
                    
                    // Add tooltip for compact deletion
                    decos.push(this.createTooltip(change, metadata))
                }
            } else if (change.inserted) {
                // Add tooltip for insertion
                decos.push(this.createTooltip(change, metadata))
            }
        })

        return DecorationSet.create(doc, decos)
    }

    createTooltip(change, metadata) {
        const pos = change.from
        return Decoration.widget(pos, () => {
            const tooltip = document.createElement('div')
            tooltip.className = 'suggestion-tooltip'
            
            const date = new Date(metadata.timestamp).toLocaleDateString()
            const type = change.deleted ? 'Deleted' : 'Added'
            tooltip.textContent = `${type} by ${metadata.user} on ${date}`
            
            return tooltip
        }, {
            key: `tooltip-${pos}`,
            side: -1,
            metadata
        })
    }

    setShowDeletedText(show) {
        this.showDeletedText = show
    }
}
