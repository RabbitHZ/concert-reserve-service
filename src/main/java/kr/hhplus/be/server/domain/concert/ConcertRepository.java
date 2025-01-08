package kr.hhplus.be.server.domain.concert;

import java.util.Optional;

public interface ConcertRepository {
    Optional<Concert> findByConcertWithSchedule(Long concertId);

    Concert save(Concert concert);
}
