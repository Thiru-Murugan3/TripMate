# Data dictionary

`place_id`: stable SHA-256-derived source record key. Not a universal real-world identity.
`name`: place name as listed by its source, with whitespace cleanup. Some records cover regions, settlements or complexes.
`state_ut`: Indian state/UT grouping from source URL or official district listing.
`district`: administrative district only where a district source establishes it; otherwise null.
`tourism_destination`: tourism site's grouping, which may differ from municipality/district.
`record_type`: ATTRACTION, DESTINATION_OR_ATTRACTION_REVIEW, or SOURCE_CLASSIFICATION_REVIEW.
`latitude`, `longitude`: WGS84 reference coordinates carried forward from the curated source snapshot; not entrance pins.
`coordinate_status`: UNKNOWN or COMMUNITY_SOURCE_REFERENCE_POINT. Candidate coordinates are in a separate table.
`source_url`, `source_provider`, `source_section`, `alternate_sources`: provenance. Section names identify multiple places listed on one page.
`detail_page_status`: whether a detail page was fetched, a district listing/section checked, or an earlier curated record retained.
`source_checked_at`: date of this source collection. Not the source's last update, photo capture date, or on-site visit date.
`opening_hours_as_published`: unvalidated source text; null does not mean closed.
`fee_status`: UNKNOWN, UNSTRUCTURED_SOURCE_EVIDENCE, or SOURCE_CHECKED_VARIANTS.
`fee_amount_inr`: intentionally null in the place table because prices have visitor/channel/scope variants. Join entry-fees instead.
`approved_photo_id`: joins reviewed-commons-photos. “Approved” here denotes starter visual screening and source-license metadata, not a warranty or independent legal clearance.
`photo_status`: NOT_REVIEWED, SOURCE_REFERENCE_ONLY, or COMMONS_PHOTO_VISUALLY_SCREENED.
`possible_duplicate_group`: exact normalized same-state name collision; review, do not merge automatically.
`publication_status`: REVIEW_REQUIRED for every record.

CSV empty cells correspond to JSON null/unknown. Arrays are JSON strings inside CSV cells. In JSON, false means false, not missing. Fee values are numeric INR per person for the stated category/conditions. Source image rights and photo identity are independent checks. candidate_latitude/longitude and image_url in the match-candidate table must never replace approved fields automatically.
