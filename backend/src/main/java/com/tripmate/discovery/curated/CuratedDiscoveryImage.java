package com.tripmate.discovery.curated;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "discovery_images")
@Getter @Setter @NoArgsConstructor
public class CuratedDiscoveryImage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "discovery_item_id") private CuratedDiscoveryItem item;
    @Column(name = "image_url", nullable = false, length = 1000) private String imageUrl;
    @Column(name = "source_page", nullable = false, length = 1000) private String sourcePage;
    @Column(name = "source_name", nullable = false, length = 180) private String sourceName;
    @Column(name = "author_name", length = 180) private String authorName;
    @Column(name = "license_name", length = 180) private String licenseName;
    @Column(length = 700) private String attribution;
    @Column(name = "exact_image", nullable = false) private boolean exactImage = true;
    @Column(name = "primary_image", nullable = false) private boolean primaryImage;
    @Column(name = "display_order", nullable = false) private int displayOrder;
}
