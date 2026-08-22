package com.tripmate.user;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity
@Table(name="users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;
    @Column(nullable=false,length=120) private String name;
    @Column(nullable=false,unique=true,length=180) private String email;
    @Column(unique=true,length=20) private String mobile;
    @Column(name="password_hash",nullable=false,length=255) private String passwordHash;
    @Enumerated(EnumType.STRING) @Column(name="system_role",nullable=false,length=20)
    @Builder.Default private SystemRole systemRole = SystemRole.USER;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20)
    @Builder.Default private UserStatus status = UserStatus.ACTIVE;
    @Column(name="created_at",nullable=false,insertable=false,updatable=false) private LocalDateTime createdAt;
    @Column(name="updated_at",nullable=false,insertable=false,updatable=false) private LocalDateTime updatedAt;
}
