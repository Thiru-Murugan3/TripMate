package com.tripmate.user;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByGoogleSubject(String googleSubject);
    boolean existsByEmailIgnoreCase(String email);
    Optional<User> findByMobile(String mobile);
    boolean existsByMobile(String mobile);
    long countByStatus(UserStatus status);
}
