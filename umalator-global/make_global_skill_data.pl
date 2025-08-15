use strict;
use warnings;
use v5.012;

use DBI;
use DBD::SQLite::Constants qw(:file_open);
use JSON::PP;

if (!@ARGV) {
	die 'Usage: make_global_skill_data.pl master.mdb';
}

my $mastermdb = shift @ARGV;

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

sub patch_modifier {
	my ($id, $value) = @_;
	my @scenario_skills = (
		210011, 210012, 210021, 210022, 210031, 210032, 210041, 210042, 210051, 210052,  # Aoharu
		210061, 210062,  # Make A New Track
		210071, 210072,  # Grand Live
		210081, 210082,  # updated URA
		210261, 210262, 210271, 210272, 210281, 210282,  # Grand Masters
		210291  # RFTS (white version of RFTS scenario skill doesn't have scaling for some reason)
	);
	if (grep(/^$id$/, @scenario_skills)) {
		return $value * 1.2;
	} else {
		return $value;
	}
}

my %split_alternatives = (
	100701 => 1,  # Seirios
	900701 => 1
);

my $select = $db->prepare(<<SQL
SELECT id, rarity,
       condition_1,
       float_ability_time_1,
       ability_type_1_1, float_ability_value_1_1, target_type_1_1,
       ability_type_1_2, float_ability_value_1_2, target_type_1_2,
       ability_type_1_3, float_ability_value_1_3, target_type_1_3,

       condition_2,
       float_ability_time_2,
       ability_type_2_1, float_ability_value_2_1, target_type_2_1,
       ability_type_2_2, float_ability_value_2_2, target_type_2_2,
       ability_type_2_3, float_ability_value_2_3, target_type_2_3
  FROM skill_data;
SQL
);

$select->execute;

my (
	$id, $rarity,
	$precondition_1, $condition_1,
	$float_ability_time_1,
	$ability_type_1_1, $float_ability_value_1_1, $target_type_1_1,
	$ability_type_1_2, $float_ability_value_1_2, $target_type_1_2,
	$ability_type_1_3, $float_ability_value_1_3, $target_type_1_3,

	$precondition_2, $condition_2,
	$float_ability_time_2,
	$ability_type_2_1, $float_ability_value_2_1, $target_type_2_1,
	$ability_type_2_2, $float_ability_value_2_2, $target_type_2_2,
	$ability_type_2_3, $float_ability_value_2_3, $target_type_2_3
);

$precondition_1 = '';
$precondition_2 = '';

$select->bind_columns(\(
	$id, $rarity,
	$condition_1,
	$float_ability_time_1,
	$ability_type_1_1, $float_ability_value_1_1, $target_type_1_1,
	$ability_type_1_2, $float_ability_value_1_2, $target_type_1_2,
	$ability_type_1_3, $float_ability_value_1_3, $target_type_1_3,

	$condition_2,
	$float_ability_time_2,
	$ability_type_2_1, $float_ability_value_2_1, $target_type_2_1,
	$ability_type_2_2, $float_ability_value_2_2, $target_type_2_2,
	$ability_type_2_3, $float_ability_value_2_3, $target_type_2_3
));

my $skills = {};
while ($select->fetch) {
	my @effects_1 = ({type => $ability_type_1_1, modifier => patch_modifier($id, $float_ability_value_1_1), target => $target_type_1_1});
	if ($ability_type_1_2 != 0) {
		push @effects_1, {type => $ability_type_1_2, modifier => patch_modifier($id, $float_ability_value_1_2), target => $target_type_1_2};
	}
	if ($ability_type_1_3 != 0) {
		push @effects_1, {type => $ability_type_1_3, modifier => patch_modifier($id, $float_ability_value_1_3), target => $target_type_1_3};
	}
	my @triggers = ({
		precondition => $precondition_1,
		condition => $condition_1,
		baseDuration => $float_ability_time_1,
		effects => \@effects_1
	});
	if ($condition_2 ne '' && $condition_2 ne '0') {
		my @effects_2 = ({type => $ability_type_2_1, modifier => patch_modifier($id, $float_ability_value_2_1), target => $target_type_2_1});
		if ($ability_type_2_2 != 0) {
			push @effects_2, {type => $ability_type_2_2, modifier => patch_modifier($id, $float_ability_value_2_2), target => $target_type_2_2};
		}
		if ($ability_type_2_3 != 0) {
			push @effects_2, {type => $ability_type_2_3, modifier => patch_modifier($id, $float_ability_value_2_3), target => $target_type_2_3};
		}
		push @triggers, {
			precondition => $precondition_2,
			condition => $condition_2,
			baseDuration => $float_ability_time_2,
			effects => \@effects_2
		};
	}
	if ($split_alternatives{$id}) {
		my @discrim = ('', map { '-' . $_ } 1..$#triggers);
		my %pairs;
		@pairs{@discrim} = @triggers;
		for my $k (keys %pairs) {
			$skills->{$id . $k} = {rarity => $rarity, alternatives => [$pairs{$k}]};
		}
	} else {
		$skills->{$id} = {rarity => $rarity, alternatives => \@triggers};
	}
}

my $json = JSON::PP->new;
$json->canonical(1);
say $json->encode($skills);
