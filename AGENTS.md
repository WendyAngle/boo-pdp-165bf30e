<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Social reach statistics share one execution-time resolver for year selection, monthly totals and source breakdowns; prefer explicit actual execution timestamps and retain the target-record execution timestamp fallback for historical data so all views stay consistent.
- Conversation and target-list tag editing reuse TargetTagDialog and targetTagKey so edits remain attached to the same target across views; render display-only historical conversation metadata tags alongside selected tags below the manual-add input, deduplicate them without implicitly writing or clearing history through target edits.
- Selected target tags in TargetTagDialog and TargetTagBadges share one badge style regardless of legacy category/tag fields, so editing and target displays stay visually consistent.
