use strict;
use warnings;
use v5.28;
use utf8;

use File::Slurper 'read_binary';
use JSON::PP;

if (!@ARGV) {
	die 'Usage: convert_old_course_data.pl old_course_data.json';
}

my $old_course_data_path = shift @ARGV;

my $old = decode_json(read_binary($old_course_data_path));

my $modern_ref = decode_json(read_binary('../../skilltool/data/course_data.json'));

my %modern;
foreach my $track (values %$old) {
	my $courses = $track->{courses};
	foreach my $course_id (keys %$courses) {
		my $c = $courses->{$course_id};
		$modern{$course_id} = {
			course => $modern_ref->{$course_id}->{course},
			courseSetStatus => $c->{courseSetStatus},
			distanceType => $c->{distanceType},
			distance => $c->{distance},
			corners => $c->{corners},
			slopes => $c->{slopes},
			straights => $c->{straights},
			# can try this to add frontType but i think there were some cases where straights were added or removed
			#straights =>[map {
			#	{ %{$c->{straights}->[$_]}, frontType => $modern_ref->{$course_id}->{straights}->[$_]->{frontType} }
			#} 0..@{$c->{straights}}],
			surface => $c->{surface},
			turn => $c->{turn},
			raceTrackId => $c->{raceTrackId}
		};
	}
}

my $json = JSON::PP->new;
$json->canonical(1);
$json->utf8(1);
say $json->encode(\%modern);
