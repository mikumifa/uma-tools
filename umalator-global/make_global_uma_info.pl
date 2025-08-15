use strict;
use warnings;
use v5.28;
use utf8;

use Cwd 'abs_path';
use File::Basename;
use File::Copy;
use File::Slurper 'read_binary';
use DBI;
use DBD::SQLite::Constants qw(:file_open);
use JSON::PP;

use Encoding qw(encode decode);
# NONE OF THIS SHIT WORKS
# I HAVE TRIED EVERY COMBINATION OF binmode(), use open qw(:std :utf8), OutputCP(), etc etc
# PROBABLY IT WORKS ON NORMAL WINDOWS BUT MY LOCALE IS SET TO JAPAN
# THE ONLY THING THAT WORKS IS encode('cp932', decode('utf8', $str))
#binmode(STDOUT, ':encoding(utf8)');
#use Win32::Console;
#Win32::Console::OutputCP(65001);

if (!@ARGV) {
	die 'Usage: make_uma_info.pl master.mdb';
}

my $mastermdb = shift @ARGV;

my $umas = decode_json(read_binary('umas.json'));
my $meta = decode_json(read_binary('skill_meta.json'));

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

sub unique_skill_for_outfit {
	my $oid = shift;
	my $i = substr($oid, 1, -2);
	my $v = substr($oid, -2);
	return 100000 + 10000 * ($v - 1) + $i * 10 + 1;
}

my $select_umas = $db->prepare('SELECT [index], text FROM text_data WHERE category = 6 AND [index] < 2000;');
my $select_outfits = $db->prepare('SELECT [index], text FROM text_data WHERE category = 5 AND [index] BETWEEN (?1 * 100) AND ((?1 + 1) * 100) ORDER BY [index] ASC;');

$select_umas->execute;

my ($id, $name);
$select_umas->bind_columns(\($id, $name));

while ($select_umas->fetch) {
	my %outfits;

	my $o_id;
	my $epithet;
	$select_outfits->execute($id);
	$select_outfits->bind_columns(\($o_id, $epithet));
	while ($select_outfits->fetch) {
		# global for some reason has data for umas not implemented yet
		my $s_id = unique_skill_for_outfit($o_id);
		if (exists $meta->{$s_id}) {
			$outfits{$o_id} = Encode::decode('utf8', $epithet);
		}
	}

	if (%outfits) {
		$umas->{$id} = {name => ["", Encode::decode('utf8', $name)], outfits => \%outfits};
	}
}

my $json = JSON::PP->new;
$json->canonical(1);
$json->utf8(1);
open(my $umas_fh, '>', 'umas.json');
print $umas_fh $json->encode($umas);
close $umas_fh;
