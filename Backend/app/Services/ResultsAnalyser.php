<?php

namespace App\Services;

/**
 * Turns published marks into every number the Results page, the Excel file and the PDF show.
 * It knows nothing about the database or HTTP, so it can be tested with plain arrays.
 *
 * Marks are percentages per learner, subject and exam. ABS is kept as null so it is counted as
 * absent but never lowers an average. A learner's subject % is the average over the exams in scope,
 * and a learner's mean is the average of their subject %s.
 */
class ResultsAnalyser
{
    /** Pass mark for "meeting expectations" (ME2 and above). */
    public const MEETING = 41;

    /** Keep in step with your school's grading policy. Highest first. */
    public const BANDS = [
        ['min' => 90, 'code' => 'EE1', 'level' => 'Exceeding',   'points' => 8],
        ['min' => 75, 'code' => 'EE2', 'level' => 'Exceeding',   'points' => 7],
        ['min' => 58, 'code' => 'ME1', 'level' => 'Meeting',     'points' => 6],
        ['min' => 41, 'code' => 'ME2', 'level' => 'Meeting',     'points' => 5],
        ['min' => 31, 'code' => 'AE1', 'level' => 'Approaching', 'points' => 4],
        ['min' => 21, 'code' => 'AE2', 'level' => 'Approaching', 'points' => 3],
        ['min' => 11, 'code' => 'BE1', 'level' => 'Below',       'points' => 2],
        ['min' => 0,  'code' => 'BE2', 'level' => 'Below',       'points' => 1],
    ];

    public const LEVELS = ['Exceeding', 'Meeting', 'Approaching', 'Below'];

    /** A change smaller than this many percentage points counts as "steady". */
    private const STEADY = 1.0;

    private array $learners = []; // id => [id, admNo, name, gender, streamId]
    private array $streams  = []; // id => [id, label, grade (int), name]
    private array $subjects = []; // id => name
    private array $exams    = []; // ordered list of [id, name, max]
    private array $marks    = []; // [learnerId][subjectId][examId] => pct|null

    /** @param array $records list of [learnerId, subjectId, examId, pct|null] */
    public function __construct(array $learners, array $streams, array $subjects, array $exams, array $records)
    {
        foreach ($learners as $l) {
            $this->learners[(int) $l['id']] = $l;
        }
        foreach ($streams as $s) {
            $this->streams[(int) $s['id']] = $s;
        }
        foreach ($subjects as $id => $name) {
            $this->subjects[(int) $id] = $name;
        }
        $this->exams = array_values($exams);

        foreach ($records as [$learnerId, $subjectId, $examId, $pct]) {
            if (isset($this->learners[(int) $learnerId])) {
                $this->marks[(int) $learnerId][(int) $subjectId][(int) $examId] = $pct === null ? null : (float) $pct;
            }
        }
    }

    public static function band(float $pct): array
    {
        foreach (self::BANDS as $b) {
            if ($pct >= $b['min']) {
                return $b;
            }
        }

        return self::BANDS[count(self::BANDS) - 1];
    }

    /** Exam ids (in exam order) that have at least one mark. */
    public function examsWithMarks(): array
    {
        $seen = [];
        foreach ($this->marks as $bySubject) {
            foreach ($bySubject as $byExam) {
                foreach ($byExam as $examId => $_) {
                    $seen[$examId] = true;
                }
            }
        }

        return array_values(array_filter(array_map(fn ($e) => (int) $e['id'], $this->exams), fn ($id) => isset($seen[$id])));
    }

    /* ------------------------------------------------------------------ */
    /* Full analysis                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * @param array $f examIds (int[]), grade (?int level), streamId (?int), compare ('auto'|'none'|int)
     */
    public function analyse(array $f): array
    {
        $examIds = array_map('intval', $f['examIds']);
        $ids     = $this->scope($f['grade'] ?? null, $f['streamId'] ?? null);

        $rows = $this->table($examIds, $ids);
        $this->rank($rows);
        $ranked = array_values(array_filter($rows, fn ($r) => $r['mean'] !== null));
        usort($ranked, fn ($a, $b) => $a['rank'] <=> $b['rank'] ?: $a['id'] <=> $b['id']);

        $active = $this->activeSubjects($ranked);

        return [
            'summary'         => $this->summary($ids, $ranked, $rows),
            'bands'           => $this->bandCounts($ranked),
            'grades'          => $this->gradeRows($ids, $rows, $active),
            'streams'         => $this->streamRows($ids, $rows, $active),
            'subjects'        => $this->subjectRows($ranked, $active),
            'subjectByStream' => $this->subjectByStream($ids, $rows, $active),
            'gender'          => $this->genderRows($ids, $rows),
            'top'             => array_map(fn ($r) => $this->line($r), array_slice($ranked, 0, 10)),
            'support'         => array_map(fn ($r) => $this->line($r), array_slice(array_reverse($ranked), 0, 10)),
            'comparison'      => $this->comparison($f['compare'] ?? 'auto', $examIds, $ids),
            'exams'           => $this->examList($this->examsWithMarks()),
        ];
    }

    /* ------------------------------------------------------------------ */
    /* One class (for the class table and report cards)                    */
    /* ------------------------------------------------------------------ */

    public function classView(int $streamId, array $examIds): array
    {
        $ids  = $this->scope(null, $streamId);
        $rows = $this->table(array_map('intval', $examIds), $ids);
        $this->rank($rows);

        $ranked = array_values(array_filter($rows, fn ($r) => $r['mean'] !== null));
        $active = $this->activeSubjects($ranked);

        $list = array_values($rows);
        usort($list, function ($a, $b) {
            if ($a['rank'] === null && $b['rank'] === null) {
                return strcmp($this->learners[$a['id']]['admNo'], $this->learners[$b['id']]['admNo']);
            }
            if ($a['rank'] === null) {
                return 1;
            }
            if ($b['rank'] === null) {
                return -1;
            }

            return $a['rank'] <=> $b['rank'] ?: strcmp($this->learners[$a['id']]['admNo'], $this->learners[$b['id']]['admNo']);
        });

        $subjects = array_map(fn ($sid) => ['id' => $sid, 'name' => $this->subjects[$sid]], $active);

        $subjectStats = array_map(function ($sid) use ($ranked) {
            $vals = array_values(array_filter(array_map(fn ($r) => $r['pcts'][$sid], $ranked), fn ($v) => $v !== null));
            $s    = $this->stats($vals);

            return ['subjectId' => $sid, 'mean' => $this->r($s['mean']), 'high' => $this->r($s['high']), 'low' => $this->r($s['low']),
                'meetingRate' => $this->r($s['meetingRate']), 'count' => $s['count']];
        }, $active);

        $st = $this->stats(array_column($ranked, 'mean'));

        return [
            'class'    => $this->streams[$streamId] ?? null,
            'subjects' => $subjects,
            'learners' => array_map(function ($r) use ($active) {
                $l = $this->learners[$r['id']];

                return [
                    'id'     => $r['id'], 'admNo' => $l['admNo'], 'name' => $l['name'], 'gender' => $l['gender'] ?? null,
                    'pcts'   => (object) array_map(fn ($v) => $this->r($v), array_intersect_key($r['pcts'], array_flip($active))),
                    'mean'   => $this->r($r['mean']), 'points' => $r['points'],
                    'code'   => $r['band']['code'] ?? null, 'level' => $r['band']['level'] ?? null, 'rank' => $r['rank'],
                ];
            }, $list),
            'ranked'       => count($ranked),
            'summary'      => ['mean' => $this->r($st['mean']), 'high' => $this->r($st['high']), 'low' => $this->r($st['low']), 'meetingRate' => $this->r($st['meetingRate'])],
            'subjectStats' => $subjectStats,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Core calculations                                                   */
    /* ------------------------------------------------------------------ */

    /** Learner ids in the chosen grade and/or stream, in admission-number order. */
    private function scope(?int $grade, ?int $streamId): array
    {
        $ids = [];
        foreach ($this->learners as $id => $l) {
            $stream = $this->streams[$l['streamId']] ?? null;
            if (! $stream) {
                continue;
            }
            if ($streamId !== null && (int) $l['streamId'] !== $streamId) {
                continue;
            }
            if ($grade !== null && (int) $stream['grade'] !== $grade) {
                continue;
            }
            $ids[] = $id;
        }
        usort($ids, fn ($a, $b) => strcmp($this->learners[$a]['admNo'], $this->learners[$b]['admNo']));

        return $ids;
    }

    /** One row per learner: subject %s, mean, points and band for the given exams. */
    private function table(array $examIds, array $learnerIds): array
    {
        $rows = [];
        foreach ($learnerIds as $id) {
            $pcts = [];
            $sum = 0.0;
            $n = 0;
            $points = 0;
            $absent = 0;

            foreach ($this->subjects as $sid => $_) {
                $vals = [];
                foreach ($examIds as $eid) {
                    if (! isset($this->marks[$id][$sid]) || ! array_key_exists($eid, $this->marks[$id][$sid])) {
                        continue;
                    }
                    $v = $this->marks[$id][$sid][$eid];
                    if ($v === null) {
                        $absent++;
                    } else {
                        $vals[] = $v;
                    }
                }
                $p = $vals ? array_sum($vals) / count($vals) : null;
                $pcts[$sid] = $p;
                if ($p !== null) {
                    $sum += $p;
                    $n++;
                    $points += self::band($p)['points'];
                }
            }

            $mean = $n ? $sum / $n : null;
            $rows[$id] = [
                'id' => $id, 'streamId' => $this->learners[$id]['streamId'], 'pcts' => $pcts, 'mean' => $mean,
                'points' => $points, 'band' => $mean === null ? null : self::band($mean), 'absent' => $absent, 'rank' => null,
            ];
        }

        return $rows;
    }

    /** Position by mean; equal means share a position. */
    private function rank(array &$rows): void
    {
        $ranked = array_filter($rows, fn ($r) => $r['mean'] !== null);
        uasort($ranked, fn ($a, $b) => $b['mean'] <=> $a['mean'] ?: $a['id'] <=> $b['id']);

        $i = 0;
        $prev = null;
        $prevRank = 0;
        foreach ($ranked as $id => $r) {
            $i++;
            $rank = ($prev !== null && abs($r['mean'] - $prev) < 1e-9) ? $prevRank : $i;
            $rows[$id]['rank'] = $rank;
            $prev = $r['mean'];
            $prevRank = $rank;
        }
    }

    private function activeSubjects(array $ranked): array
    {
        $active = [];
        foreach ($this->subjects as $sid => $_) {
            foreach ($ranked as $r) {
                if ($r['pcts'][$sid] !== null) {
                    $active[] = $sid;
                    break;
                }
            }
        }

        return $active;
    }

    private function stats(array $vals): array
    {
        $n = count($vals);
        if (! $n) {
            return ['count' => 0, 'mean' => null, 'median' => null, 'high' => null, 'low' => null, 'sd' => null, 'meetingRate' => null];
        }
        $mean = array_sum($vals) / $n;
        $sorted = $vals;
        sort($sorted);
        $mid = intdiv($n, 2);
        $median = $n % 2 ? $sorted[$mid] : ($sorted[$mid - 1] + $sorted[$mid]) / 2;
        $var = array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $vals)) / $n;

        return [
            'count' => $n, 'mean' => $mean, 'median' => $median, 'high' => max($vals), 'low' => min($vals), 'sd' => sqrt($var),
            'meetingRate' => count(array_filter($vals, fn ($v) => $v >= self::MEETING)) / $n * 100,
        ];
    }

    private function r(?float $v, int $dp = 1): ?float
    {
        return $v === null ? null : round($v, $dp);
    }

    private function levelShare(array $pcts): array
    {
        $out = array_fill_keys(self::LEVELS, 0);
        foreach ($pcts as $p) {
            $out[self::band($p)['level']]++;
        }
        $n = count($pcts);

        return array_map(fn ($c) => $n ? round($c / $n * 100, 1) : 0.0, $out);
    }

    private function allPcts(array $rows): array
    {
        $out = [];
        foreach ($rows as $r) {
            foreach ($r['pcts'] as $p) {
                if ($p !== null) {
                    $out[] = $p;
                }
            }
        }

        return $out;
    }

    private function className(int $learnerId): string
    {
        return $this->streams[$this->learners[$learnerId]['streamId']]['label'] ?? '';
    }

    /** Best and weakest subject (by %) for a learner row. */
    private function extremes(array $pcts): array
    {
        $vals = array_filter($pcts, fn ($v) => $v !== null);
        if (! $vals) {
            return [null, null];
        }
        arsort($vals);

        return [$this->subjects[array_key_first($vals)], $this->subjects[array_key_last($vals)]];
    }

    private function line(array $r): array
    {
        $l = $this->learners[$r['id']];
        [$best, $weak] = $this->extremes($r['pcts']);

        return [
            'id' => $r['id'], 'admNo' => $l['admNo'], 'name' => $l['name'], 'className' => $this->className($r['id']),
            'gender' => $l['gender'] ?? null, 'mean' => $this->r($r['mean']), 'code' => $r['band']['code'] ?? null,
            'level' => $r['band']['level'] ?? null, 'rank' => $r['rank'], 'best' => $best, 'weakest' => $weak,
            'belowCount' => count(array_filter($r['pcts'], fn ($v) => $v !== null && $v < self::MEETING)),
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Sections                                                            */
    /* ------------------------------------------------------------------ */

    private function summary(array $ids, array $ranked, array $rows): array
    {
        $st = $this->stats(array_column($ranked, 'mean'));
        $streamIds = [];
        foreach ($ids as $id) {
            $streamIds[$this->learners[$id]['streamId']] = true;
        }

        return [
            'learners'     => count($ids),
            'withResults'  => count($ranked),
            'mean'         => $this->r($st['mean']),
            'median'       => $this->r($st['median']),
            'high'         => $this->r($st['high']),
            'low'          => $this->r($st['low']),
            'sd'           => $this->r($st['sd']),
            'meetingRate'  => $this->r($st['meetingRate']),
            'belowMeeting' => count(array_filter($ranked, fn ($r) => $r['mean'] < self::MEETING)),
            'absentMarks'  => array_sum(array_column($rows, 'absent')),
            'subjects'     => count($this->activeSubjects($ranked)),
            'streams'      => count($streamIds),
            'meetingMark'  => self::MEETING,
        ];
    }

    private function bandCounts(array $ranked): array
    {
        $pcts = $this->allPcts($ranked);
        $total = count($pcts);
        $counts = array_fill_keys(array_column(self::BANDS, 'code'), 0);
        foreach ($pcts as $p) {
            $counts[self::band($p)['code']]++;
        }

        return array_map(fn ($b) => [
            'code' => $b['code'], 'level' => $b['level'], 'min' => $b['min'], 'count' => $counts[$b['code']],
            'pct' => $total ? round($counts[$b['code']] / $total * 100, 1) : 0.0,
        ], self::BANDS);
    }

    /** Learner ids grouped by a key function. */
    private function groupIds(array $ids, callable $key): array
    {
        $g = [];
        foreach ($ids as $id) {
            $g[$key($id)][] = $id;
        }

        return $g;
    }

    private function statBlock(array $groupIds, array $rows): array
    {
        $ranked = array_values(array_filter(array_map(fn ($id) => $rows[$id], $groupIds), fn ($r) => $r['mean'] !== null));
        $st = $this->stats(array_column($ranked, 'mean'));
        usort($ranked, fn ($a, $b) => $b['mean'] <=> $a['mean'] ?: $a['id'] <=> $b['id']);
        $top = $ranked[0] ?? null;

        return [
            'learners' => count($groupIds), 'withResults' => count($ranked), 'mean' => $this->r($st['mean']),
            'median' => $this->r($st['median']), 'high' => $this->r($st['high']), 'low' => $this->r($st['low']),
            'meetingRate' => $this->r($st['meetingRate']),
            'levels' => $this->levelShare($this->allPcts($ranked)),
            'top' => $top ? ['name' => $this->learners[$top['id']]['name'], 'className' => $this->className($top['id']), 'mean' => $this->r($top['mean'])] : null,
            '_ranked' => $ranked,
        ];
    }

    private function gradeRows(array $ids, array $rows, array $active): array
    {
        $groups = $this->groupIds($ids, fn ($id) => (int) $this->streams[$this->learners[$id]['streamId']]['grade']);
        ksort($groups);

        $out = [];
        foreach ($groups as $grade => $gids) {
            $b = $this->statBlock($gids, $rows);
            unset($b['_ranked']);
            $streamCount = count(array_unique(array_map(fn ($id) => $this->learners[$id]['streamId'], $gids)));
            $out[] = ['grade' => $grade, 'label' => "Grade {$grade}", 'streams' => $streamCount] + $b;
        }

        return $out;
    }

    private function streamRows(array $ids, array $rows, array $active): array
    {
        $groups = $this->groupIds($ids, fn ($id) => (int) $this->learners[$id]['streamId']);

        $out = [];
        foreach ($groups as $sid => $gids) {
            $b = $this->statBlock($gids, $rows);
            $ranked = $b['_ranked'];
            unset($b['_ranked']);

            $subj = [];
            foreach ($active as $subId) {
                $vals = array_values(array_filter(array_map(fn ($r) => $r['pcts'][$subId], $ranked), fn ($v) => $v !== null));
                if ($vals) {
                    $subj[$subId] = array_sum($vals) / count($vals);
                }
            }
            arsort($subj);

            $s = $this->streams[$sid];
            $out[] = ['id' => $sid, 'label' => $s['label'], 'grade' => (int) $s['grade'],
                'best' => $subj ? $this->subjects[array_key_first($subj)] : null,
                'weakest' => count($subj) > 1 ? $this->subjects[array_key_last($subj)] : null] + $b;
        }

        // overall position, and position within the grade
        usort($out, fn ($a, $b) => ($b['mean'] ?? -1) <=> ($a['mean'] ?? -1) ?: strcmp($a['label'], $b['label']));
        $inGrade = [];
        foreach ($out as $i => &$row) {
            $row['rank'] = $row['mean'] === null ? null : $i + 1;
            $inGrade[$row['grade']] = ($inGrade[$row['grade']] ?? 0) + 1;
            $row['rankInGrade'] = $row['mean'] === null ? null : $inGrade[$row['grade']];
        }
        unset($row);

        return $out;
    }

    private function subjectRows(array $ranked, array $active): array
    {
        $out = [];
        foreach ($active as $sid) {
            $vals = [];
            $byGrade = [];
            $byStream = [];
            foreach ($ranked as $r) {
                $p = $r['pcts'][$sid];
                if ($p === null) {
                    continue;
                }
                $vals[] = $p;
                $byGrade[(int) $this->streams[$r['streamId']]['grade']][] = $p;
                $byStream[$r['streamId']][] = $p;
            }
            $st = $this->stats($vals);

            $grades = [];
            ksort($byGrade);
            foreach ($byGrade as $g => $v) {
                $grades[(string) $g] = round(array_sum($v) / count($v), 1);
            }

            $streamMeans = array_map(fn ($v) => array_sum($v) / count($v), $byStream);
            arsort($streamMeans);

            $out[] = [
                'id' => $sid, 'name' => $this->subjects[$sid], 'count' => $st['count'], 'mean' => $this->r($st['mean']),
                'high' => $this->r($st['high']), 'low' => $this->r($st['low']), 'sd' => $this->r($st['sd']),
                'meetingRate' => $this->r($st['meetingRate']), 'byGrade' => (object) $grades,
                'bestStream' => $streamMeans ? $this->streams[array_key_first($streamMeans)]['label'] : null,
                'weakestStream' => count($streamMeans) > 1 ? $this->streams[array_key_last($streamMeans)]['label'] : null,
                'levels' => $this->levelShare($vals),
            ];
        }
        usort($out, fn ($a, $b) => $b['mean'] <=> $a['mean'] ?: strcmp($a['name'], $b['name']));

        return $out;
    }

    private function subjectByStream(array $ids, array $rows, array $active): array
    {
        $groups = $this->groupIds($ids, fn ($id) => (int) $this->learners[$id]['streamId']);
        $streamList = array_keys($groups);
        usort($streamList, fn ($a, $b) => ($this->streams[$a]['grade'] <=> $this->streams[$b]['grade']) ?: strcmp($this->streams[$a]['name'], $this->streams[$b]['name']));

        $matrix = [];
        foreach ($active as $sid) {
            $means = [];
            foreach ($streamList as $stId) {
                $vals = [];
                foreach ($groups[$stId] as $id) {
                    $p = $rows[$id]['pcts'][$sid] ?? null;
                    if ($p !== null) {
                        $vals[] = $p;
                    }
                }
                $means[] = $vals ? round(array_sum($vals) / count($vals), 1) : null;
            }
            $matrix[] = ['subject' => $this->subjects[$sid], 'means' => $means];
        }

        return [
            'streams' => array_map(fn ($s) => ['id' => $s, 'label' => $this->streams[$s]['label']], $streamList),
            'rows'    => $matrix,
        ];
    }

    private function genderRows(array $ids, array $rows): array
    {
        $groups = $this->groupIds($ids, fn ($id) => $this->learners[$id]['gender'] ?? 'Not stated');
        ksort($groups);

        $out = [];
        foreach ($groups as $gender => $gids) {
            $b = $this->statBlock($gids, $rows);
            $out[] = ['gender' => $gender, 'learners' => $b['learners'], 'withResults' => $b['withResults'],
                'mean' => $b['mean'], 'meetingRate' => $b['meetingRate'], 'levels' => $b['levels']];
        }

        return $out;
    }

    private function examList(array $ids): array
    {
        $byId = [];
        foreach ($this->exams as $e) {
            $byId[(int) $e['id']] = ['id' => (int) $e['id'], 'name' => $e['name'], 'max' => (int) $e['max']];
        }

        return array_values(array_map(fn ($id) => $byId[$id], array_filter($ids, fn ($id) => isset($byId[$id]))));
    }

    /* ------------------------------------------------------------------ */
    /* Comparison with an earlier exam                                     */
    /* ------------------------------------------------------------------ */

    private function comparison($compare, array $examIds, array $ids): ?array
    {
        if ($compare === 'none') {
            return null;
        }

        $with = $this->examsWithMarks();
        $cur = count($examIds) === 1 ? $examIds[0] : (count($with) ? $with[count($with) - 1] : null);
        if ($cur === null) {
            return null;
        }

        if (is_int($compare) || (is_string($compare) && ctype_digit($compare))) {
            $prev = (int) $compare;
        } else {
            $pos = array_search($cur, $with, true);
            $prev = ($pos !== false && $pos > 0) ? $with[$pos - 1] : null;
        }
        if ($prev === null || $prev === $cur) {
            return null;
        }

        $names = [];
        foreach ($this->exams as $e) {
            $names[(int) $e['id']] = $e['name'];
        }
        $out = ['current' => ['id' => $cur, 'name' => $names[$cur] ?? ''], 'previous' => ['id' => $prev, 'name' => $names[$prev] ?? ''],
            'paired' => 0, 'summary' => null, 'subjects' => [], 'streams' => [], 'grades' => [], 'improved' => [], 'declined' => []];

        $now = $this->table([$cur], $ids);
        $was = $this->table([$prev], $ids);
        $this->rank($now);
        $this->rank($was);

        $paired = array_values(array_filter($ids, fn ($id) => $now[$id]['mean'] !== null && $was[$id]['mean'] !== null));
        $out['paired'] = count($paired);
        if (! $paired) {
            return $out;
        }

        $change = fn ($id) => $now[$id]['mean'] - $was[$id]['mean'];
        $avg = fn (array $v) => array_sum($v) / count($v);

        $out['summary'] = [
            'meanNow'  => round($avg(array_map(fn ($id) => $now[$id]['mean'], $paired)), 1),
            'meanPrev' => round($avg(array_map(fn ($id) => $was[$id]['mean'], $paired)), 1),
            'improved' => count(array_filter($paired, fn ($id) => $change($id) >= self::STEADY)),
            'declined' => count(array_filter($paired, fn ($id) => $change($id) <= -self::STEADY)),
        ];
        $out['summary']['steady'] = count($paired) - $out['summary']['improved'] - $out['summary']['declined'];
        $out['summary']['change'] = round($out['summary']['meanNow'] - $out['summary']['meanPrev'], 1);

        // subjects (paired learners who have a mark in both exams)
        foreach ($this->subjects as $sid => $name) {
            $a = [];
            $b = [];
            foreach ($paired as $id) {
                if ($now[$id]['pcts'][$sid] !== null && $was[$id]['pcts'][$sid] !== null) {
                    $a[] = $now[$id]['pcts'][$sid];
                    $b[] = $was[$id]['pcts'][$sid];
                }
            }
            if ($a) {
                $out['subjects'][] = ['name' => $name, 'now' => round($avg($a), 1), 'prev' => round($avg($b), 1),
                    'change' => round($avg($a) - $avg($b), 1), 'n' => count($a)];
            }
        }
        usort($out['subjects'], fn ($x, $y) => $y['change'] <=> $x['change']);

        // streams and grades
        $byStream = $this->groupIds($paired, fn ($id) => (int) $this->learners[$id]['streamId']);
        foreach ($byStream as $stId => $g) {
            $n = $avg(array_map(fn ($id) => $now[$id]['mean'], $g));
            $p = $avg(array_map(fn ($id) => $was[$id]['mean'], $g));
            $out['streams'][] = ['label' => $this->streams[$stId]['label'], 'grade' => (int) $this->streams[$stId]['grade'],
                'now' => round($n, 1), 'prev' => round($p, 1), 'change' => round($n - $p, 1), 'n' => count($g)];
        }
        usort($out['streams'], fn ($x, $y) => $y['change'] <=> $x['change']);

        $byGrade = $this->groupIds($paired, fn ($id) => (int) $this->streams[$this->learners[$id]['streamId']]['grade']);
        ksort($byGrade);
        foreach ($byGrade as $grade => $g) {
            $n = $avg(array_map(fn ($id) => $now[$id]['mean'], $g));
            $p = $avg(array_map(fn ($id) => $was[$id]['mean'], $g));
            $out['grades'][] = ['label' => "Grade {$grade}", 'now' => round($n, 1), 'prev' => round($p, 1), 'change' => round($n - $p, 1), 'n' => count($g)];
        }

        // movers
        $mover = function ($id) use ($now, $was, $change) {
            $l = $this->learners[$id];

            return ['id' => $id, 'admNo' => $l['admNo'], 'name' => $l['name'], 'className' => $this->className($id),
                'now' => round($now[$id]['mean'], 1), 'prev' => round($was[$id]['mean'], 1), 'change' => round($change($id), 1),
                'nowCode' => $now[$id]['band']['code'], 'prevCode' => $was[$id]['band']['code'],
                'rankNow' => $now[$id]['rank'], 'rankPrev' => $was[$id]['rank']];
        };
        $sorted = $paired;
        usort($sorted, fn ($a, $b) => $change($b) <=> $change($a) ?: $a <=> $b);
        $out['improved'] = array_map($mover, array_slice(array_values(array_filter($sorted, fn ($id) => $change($id) > 0)), 0, 10));
        $out['declined'] = array_map($mover, array_slice(array_values(array_filter(array_reverse($sorted), fn ($id) => $change($id) < 0)), 0, 10));

        return $out;
    }
}